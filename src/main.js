const { GitHubClient } = require("./github-client");
const { DataSet } = require("vis-data");
const { Network } = require("vis-network");
const {
  parseGitHubUrl,
  getReferences,
  ReferenceParser,
} = require("./reference-parser");
const { getAccessToken } = require("./github-auth");

const referenceTypes = {
  default: {
    alias: { id: "refers" },
  },
  refers: {
    prefixes: ["refers", "refer", "reference"],
    edge: {
      color: {
        color: "#848484",
        opacity: 0.1,
      },
      length: 200,
    },
    follow: false,
  },
  requires: {
    prefixes: ["requires", "depends on", "depends", "needs"],
    edge: {
      color: "red",
      length: 50,
    },
  },
  required_by: {
    prefixes: ["required by", "needed by"],
    alias: { id: "requires", reverse: true },
  },
  resolves: {
    prefixes: ["resolve", "resolves", "resolved"],
    alias: { id: "requires", reverse: true },
  },
  closes: {
    prefixes: ["close", "closes", "closed"],
    alias: { id: "requires", reverse: true },
  },
  fixes: {
    prefixes: ["fixes", "fix", "fixed"],
    alias: { id: "requires", reverse: true },
  },
  part_of: {
    prefixes: ["part of"],
    alias: { id: "requires", reverse: true },
  },
  superseded_by: {
    prefixes: ["superseded by"],
    alias: { id: "requires" },
  },
};

let client;

const nodeSymbol = Symbol("node");
const lookup = {};
const workQueue = [];
const referenceParser = new ReferenceParser(referenceTypes);

function queue(work) {
  const { owner, repo, number, depth } = work;
  console.assert(owner);
  console.assert(repo);
  console.assert(number);
  const id = `${owner}/${repo}#${number}`;
  if (lookup[id]) {
    if (lookup[id].depth > depth) {
      lookup[id].depth = depth;
      lookup[id][nodeSymbol].level = depth;
    }
    return;
  }
  lookup[id] = work;
  workQueue.unshift(work);
}

async function worker() {
  while (workQueue.length) {
    const work = workQueue.pop();
    await handleWork(work);
  }
}

async function tryCatch(tryer, catcher) {
  try {
    return await tryer();
  } catch (error) {
    return await catcher(error);
  }
}

async function handleWork(work) {
  const { owner, repo, number, source, depth } = work;
  const current = {
    owner,
    repo,
    number,
  };
  const { result, error } = await tryCatch(
    async () => ({
      result: await client.getIssueOrPullRequest({ owner, repo, number }),
    }),
    async (error) => ({ error })
  );

  if (error) {
    nodes.add({
      id: `${owner}/${repo}#${number}`,
      title: error.toString(),
      label: `${owner}/${repo}#${number}`,
      color: "white",
    });
    return;
  }

  const position = (() => {
    if (source) {
      const sourceId = getId(source);
      const position = network.getPositions([sourceId])[sourceId];
      const angle = Math.random() * Math.PI * 2;
      return {
        x: position.x + Math.cos(angle) * 100,
        y: position.y + Math.sin(angle) * 100,
      };
    } else {
      return { x: 0, y: 0 };
    }
  })();

  const node = createNode({ owner, repo, number, position, ...result });

  work[nodeSymbol] = node;
  nodes.add(node);

  for (const timelineItem of result.timelineItems.nodes) {
    const source = timelineItem.source;
    const owner = source.repository.owner.login;
    const repo = source.repository.name;
    const number = source.number;
    queue({ owner, repo, number, source: work, depth: depth + 1 });
  }

  const references = referenceParser.getReferences({
    source: current,
    text: result.body,
  });
  for (const reference of references) {
    if (reference.follow) {
      queue({ ...reference.target, source: work, depth: depth + 1 });
    }
    edges.add(createEdge(reference));
  }

  for (const comment of result.comments.nodes) {
    const references = referenceParser.getReferences({
      source: current,
      text: comment.body,
    });
    for (const reference of references) {
      if (reference.follow) {
        queue({ ...reference.target, source: current, depth: depth + 1 });
      }
      edges.add(createEdge(reference));
    }
  }
}

function getId({ owner, repo, number }) {
  return `${owner}/${repo}#${number}`;
}

function createEdge(reference) {
  const { source, target, referenceType } = reference;
  return {
    arrows: {
      to: {
        enabled: true,
      },
    },
    ...referenceType.edge,
    from: getId(source),
    to: getId(target),
  };
}

function c(type, attrs, children) {
  const result = document.createElement(type);
  for (const [key, value] of Object.entries(attrs)) {
    result.setAttribute(key, value);
  }
  for (const child of children) {
    result.appendChild(child);
  }
  return result;
}

function createNode({
  position,
  depth,
  issueState,
  pullRequestState,
  isDraft,
  owner,
  repo,
  number,
  title,
  body,
  author,
}) {
  const isPullRequest = !!pullRequestState;
  const url = pullRequestState
    ? `https://github.com/${owner}/${repo}/pull/${number}`
    : `https://github.com/${owner}/${repo}/issues/${number}`;
  const iconName = isPullRequest
    ? isDraft
      ? "git-pull-request-draft"
      : {
          OPEN: "git-pull-request",
          CLOSED: "git-pull-request-closed",
          MERGED: "git-merge",
        }[pullRequestState]
    : {
        OPEN: "issue-opened",
        CLOSED: "issue-closed",
      }[issueState];
  const image = `https://raw.githubusercontent.com/primer/octicons/main/icons/${iconName}-24.svg`;

  const tooltip = c("div", {}, [
    c("div", {}, [document.createTextNode(`${owner}/${repo}`)]),
    c("h1", { class: "title" }, [
      document.createTextNode(title),
      c("span", { class: "number" }, [document.createTextNode(`#${number}`)]),
    ]),
    c("div", { class: "author" }, [
      document.createTextNode("by "),
      c("img", { src: author.avatarUrl, class: "avatar" }, []),
      c("span", { class: "name" }, [
        document.createTextNode(`@${author.login}`),
      ]),
    ]),
  ]);

  return {
    id: `${owner}/${repo}#${number}`,
    x: position?.x,
    y: position?.y,
    title: tooltip,
    label: `${owner}/${repo}#${number}`,
    url,
    shape: "circularImage",
    image,
    imagePadding: 10,
    level: depth,
    color: isDraft
      ? "#6a737d"
      : {
          CLOSED: "#d73a49",
          MERGED: "#6f42c1",
          OPEN: "#28a745",
        }[issueState || pullRequestState],
  };
}

const root = document.getElementById("root");
const nodes = new DataSet([]);
const edges = new DataSet([]);
const data = {
  nodes,
  edges,
};
const options = {
  interaction: {
    hover: true,
    hoverConnectedEdges: true,
    tooltipDelay: 300,
  },
  nodes: {
    shadow: true,
  },
  edges: {
    shadow: true,
  },
  physics: {
    barnesHut: {
      damping: 0.1,
      avoidOverlap: 0,
    },
    maxVelocity: 10,
  },
};
const network = new Network(root, data, options);
let initialWork;
network.on("hoverNode", () => {});

// network.on("click", () => {
//   nodes.forEach((node) => {
//     node.opacity = 0.1;
//     nodes.update(node);
//   });

//   const queue = [initialWork[nodeSymbol].id];
//   const seen = new Set();
//   while (queue.length) {
//     const nodeId = queue.shift();
//     for (const childNodeId of network.getConnectedNodes(nodeId, "to")) {
//       if (!seen.has(childNodeId)) {
//         seen.add(childNodeId);
//         queue.push(childNodeId);
//       }
//     }

//     const node = nodes.get(nodeId);
//     node.opacity = 1;
//     nodes.update(node);
//   }
// });

network.on("doubleClick", ({ nodes: selectedNodeIds }) => {
  if (selectedNodeIds.length) {
    const nodeId = selectedNodeIds[0];
    const node = nodes.get(nodeId);
    window.open(node.url, "_blank");
  }
});

async function run() {
  const token = await getAccessToken();

  client = new GitHubClient({ token });

  const params = new URL(window.location.href).searchParams;
  const initialUrl = params.get("url");

  initialWork = { ...parseGitHubUrl(initialUrl), depth: 0 };
  queue(initialWork);
  worker();
}
run();
