import { Octokit } from "@octokit/rest";

export const GITHUB_CONFIG_KEY = "mindset.github.config";
export const DATABASE_PATH = "database.json";

export const EMPTY_DATABASE = {
  version: 1,
  clients: [],
  loans: [],
  updatedAt: null,
};

let cachedSha = null;
let writeQueue = Promise.resolve();

export function getGithubConfig() {
  const raw = localStorage.getItem(GITHUB_CONFIG_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    const config = normalizeConfig(parsed);
    return config.token && config.owner && config.repo ? config : null;
  } catch {
    return null;
  }
}

export function saveGithubConfig(input) {
  const config = normalizeConfig(input);
  assertConfig(config);
  localStorage.setItem(GITHUB_CONFIG_KEY, JSON.stringify(config));
  cachedSha = null;
  return config;
}

export function clearGithubConfig() {
  localStorage.removeItem(GITHUB_CONFIG_KEY);
  cachedSha = null;
}

export function createOctokit(config = getGithubConfig()) {
  assertConfig(config);
  return new Octokit({
    auth: config.token,
    userAgent: "mindset-prestamos",
  });
}

export async function testGithubConnection(input = getGithubConfig()) {
  const config = normalizeConfig(input);
  assertConfig(config);
  const octokit = createOctokit(config);

  try {
    const { data } = await octokit.repos.get({
      owner: config.owner,
      repo: config.repo,
    });

    return {
      fullName: data.full_name,
      private: Boolean(data.private),
      defaultBranch: data.default_branch,
      permissions: data.permissions ?? null,
    };
  } catch (error) {
    throw mapGithubError(error);
  }
}

export async function readDatabase(input = getGithubConfig()) {
  const config = normalizeConfig(input);
  assertConfig(config);
  const octokit = createOctokit(config);

  try {
    const { data } = await octokit.repos.getContent({
      owner: config.owner,
      repo: config.repo,
      path: DATABASE_PATH,
      ref: config.branch,
    });

    if (Array.isArray(data) || data.type !== "file" || typeof data.content !== "string") {
      throw new Error("database.json existe, pero no es un archivo de texto.");
    }

    const state = normalizeDatabase(JSON.parse(decodeBase64Utf8(data.content)));
    cachedSha = data.sha;
    return {
      state,
      sha: data.sha,
      path: data.path,
      missing: false,
    };
  } catch (error) {
    if (error.status === 404) {
          try {
            await octokit.repos.get({ owner: config.owner, repo: config.repo });
          } catch (repoError) {
            throw mapGithubError(repoError);
          }

          cachedSha = null;
          return {
            state: structuredClone(EMPTY_DATABASE),
            sha: null,
            path: DATABASE_PATH,
            missing: true,
          };
        }
    throw mapGithubError(error);
  }
}

export function writeDatabase(nextState, options = {}) {
  const run = () => persistDatabase(nextState, options);
  const result = writeQueue.then(run, run);
  writeQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function persistDatabase(nextState, options) {
  const config = normalizeConfig(options.config ?? getGithubConfig());
  assertConfig(config);
  const octokit = createOctokit(config);
  const state = {
    ...normalizeDatabase(nextState),
    updatedAt: new Date().toISOString(),
  };
  const content = encodeBase64Utf8(JSON.stringify(state, null, 2));
  const message = options.message?.trim() || `sync: actualizar database.json (${state.updatedAt})`;

  let sha = options.sha ?? cachedSha;
  if (!sha) {
    const current = await readDatabase(config);
    sha = current.sha;
  }

  try {
    const saved = await putDatabase({ octokit, config, content, message, sha });
    return { ...saved, state };
  } catch (error) {
    if (error.status !== 409 && error.status !== 422) {
      throw mapGithubError(error);
    }

    const current = await readDatabase(config);
    const saved = await putDatabase({
      octokit,
      config,
      content,
      message,
      sha: current.sha,
    });
    return { ...saved, state, retried: true };
  }
}

async function putDatabase({ octokit, config, content, message, sha }) {
  const { data } = await octokit.repos.createOrUpdateFileContents({
    owner: config.owner,
    repo: config.repo,
    path: DATABASE_PATH,
    message,
    content,
    branch: config.branch,
    ...(sha ? { sha } : {}),
  });

  cachedSha = data.content?.sha ?? null;
  return {
    sha: cachedSha,
    commitSha: data.commit?.sha ?? null,
    path: DATABASE_PATH,
  };
}

export function normalizeDatabase(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    version: 1,
    clients: Array.isArray(source.clients) ? source.clients : [],
    loans: Array.isArray(source.loans) ? source.loans : [],
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : null,
  };
}

function normalizeConfig(input) {
  return {
    token: String(input?.token ?? "").trim(),
    owner: String(input?.owner ?? input?.username ?? "").trim(),
    repo: String(input?.repo ?? "").trim(),
    branch: String(input?.branch ?? "main").trim() || "main",
  };
}

function assertConfig(config) {
  if (!config?.token || !config.owner || !config.repo) {
    throw new Error("Falta el token, el usuario o el repositorio de GitHub.");
  }
}

function encodeBase64Utf8(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

function decodeBase64Utf8(value) {
  const binary = atob(value.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function mapGithubError(error) {
  const status = error?.status;
  const apiMessage = error?.response?.data?.message;
  const messages = {
    401: "El token fue rechazado. Revisa que el PAT sea válido.",
    403: "GitHub bloqueó la operación. El token necesita permiso de lectura y escritura sobre el repositorio.",
    404: "No se encontró el repositorio. Si es privado, el token también debe poder verlo.",
    409: "El archivo cambió en GitHub. Se reintentó la escritura, pero sigue habiendo un conflicto.",
    422: "GitHub no pudo guardar database.json. Revisa el nombre del archivo y el sha actual.",
  };

  const wrapped = new Error(messages[status] || apiMessage || "No se pudo sincronizar con GitHub.");
  wrapped.status = status;
  wrapped.cause = error;
  return wrapped;
}
