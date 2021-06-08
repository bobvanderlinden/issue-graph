const { GitHubClient } = require("./github-client");
const { DataSet } = require("vis-data");
const { Network } = require("vis-network");
const { parseGitHubUrl, getReferences } = require("./references");

const params = new URL(window.location.href).searchParams;
const token = params.get("token");
const initialUrl = params.get("url");

const client = new GitHubClient({ token });

async function resolveReference(reference) {
  switch (reference.type) {
    case "GitHubIssue":
      return await client.getIssue(reference);
    case "GitHubPullRequest":
      return await client.getPullRequest(reference);
    default:
      throw new Error(`Unknown reference type ${reference.type}`);
  }
}

const seen = new Set();
const workQueue = [];

function queue(url) {
  if (seen.has(url)) {
    return;
  }
  seen.add(url);
  workQueue.push(url);
}

async function worker() {
  while (workQueue.length) {
    const url = workQueue.pop();
    await handleUrl(url);
  }
}

async function handleUrl(url) {
  const meta = parseGitHubUrl(url);
  const result = await resolveReference(meta);

  nodes.add(createNode({ ...meta, ...result }));

  for (const timelineItem of result.timelineItems.nodes) {
    const url = timelineItem?.source?.url;
    if (url) {
      queue(url);
    }
  }

  const references = getReferences(result.body);
  for (const reference of references) {
    queue(reference.url);
    edges.add(createEdge(url, reference));
  }

  network.redraw();
}

function createEdge(source, reference) {
  return {
    from: source,
    to: reference.url,
    label: reference.name,
  };
}

function createNode({ url, state, owner, repo, number, title }) {
  return {
    id: url,
    title: title,
    label: `${owner}/${repo}#${number}`,
    color: {
      DRAFT: "#6a737d",
      CLOSED: "#d73a49",
      MERGED: "#6f42c1",
      OPEN: "#28a745",
    }[state],
  };
}

const root = document.getElementById("root");
const nodes = new DataSet([]);
const edges = new DataSet([]);
const data = {
  nodes,
  edges,
};
const network = new Network(root, data, {});

network.on("doubleClick", ({ nodes }) => {
  if (nodes.length) {
    window.open(nodes[0], "_blank");
  }
});

queue(initialUrl);
worker();
