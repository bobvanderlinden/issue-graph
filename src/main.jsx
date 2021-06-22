import { GitHubCrawler } from "./github-crawler";
import "./main.css";
import { useParam } from "./use-param";
const React = require("react");
const { useRef, useCallback, useEffect, useState } = require("react");
const ReactDOM = require("react-dom");
const {
  Icon,
  Dropdown,
  Loader,
  Dimmer,
  Button,
  Modal,
  Form,
  Container,
  Grid,
  Label,
  Image,
} = require("semantic-ui-react");
const { GitHubClient } = require("./github-client");
const { GitHubAuthClient } = require("./github-auth-client");
const { GitHubAuthProvider, useGitHubAuth } = require("./github-auth");
const { DataSet } = require("vis-data");
const { Network } = require("vis-network");
const {
  parseGitHubUrl,
  getReferences,
  ReferenceParser,
} = require("./reference-parser");
const { Menu } = require("semantic-ui-react");
const { useForm } = require("react-hook-form");
const { referenceUrlRegex } = require("./reference-parser");

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

const nodes = new DataSet([]);
const edges = new DataSet([]);
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

function Graph({ url }) {
  const { isLoading, user } = useGitHubAuth();

  console.log(isLoading, user);

  const token = user?.token;

  useEffect(() => {
    const client = new GitHubClient({ token });

    const crawler = new GitHubCrawler({
      client,
      referenceParser: new ReferenceParser(referenceTypes),
    });

    crawler.addEventListener("nodeError", (event) => {
      const { owner, repo, number } = event.node;
      console.log(event);
      const error = event.error;
      console.error(error);
      nodes.add({
        id: `${owner}/${repo}#${number}`,
        title: error.toString(),
        label: `${owner}/${repo}#${number}`,
        color: "white",
      });
    });
    crawler.addEventListener("nodeFound", (event) => {
      const { owner, repo, number, ...result } = event.node;
      // const position = undefined;
      // const position = (() => {
      //   if (source) {
      //     const sourceId = getId(source);
      //     const position = network.getPositions([sourceId])[sourceId];
      //     const angle = Math.random() * Math.PI * 2;
      //     return {
      //       x: position.x + Math.cos(angle) * 100,
      //       y: position.y + Math.sin(angle) * 100,
      //     };
      //   } else {
      //     return { x: 0, y: 0 };
      //   }
      // })();

      const node = createNode({
        owner,
        repo,
        number,
        position: { x: 0, y: 0 },
        ...result,
      });

      // work[nodeSymbol] = node;
      nodes.add(node);
    });
    crawler.addEventListener("referenceFound", (event) => {
      edges.add(createEdge(event.reference));
    });

    crawler.queue({ ...parseGitHubUrl(url), depth: 0 });

    crawler.start();

    return () => {
      console.log("stopping crawler");
      crawler.stop();
    };
  }, [url, token]);

  const graphRef = useCallback((graph) => {
    if (!graph) {
      return;
    }
    const network = new Network(
      graph,
      {
        nodes,
        edges,
      },
      options
    );
    network.on("doubleClick", ({ nodes: selectedNodeIds }) => {
      if (selectedNodeIds.length) {
        const nodeId = selectedNodeIds[0];
        const node = nodes.get(nodeId);
        window.open(node.url, "_blank");
      }
    });
  });

  return <div className="graph" ref={graphRef} />;
}

function ErrorModal({ error }) {
  const [open, setOpen] = useState(true);
  return (
    <Modal
      onClose={() => setOpen(false)}
      onOpen={() => setOpen(true)}
      open={open}
    >
      <Modal.Header>Error</Modal.Header>
      <Modal.Content>
        <Modal.Description>
          <p>${error.toString()}</p>
        </Modal.Description>
      </Modal.Content>
      <Modal.Actions>
        <Button content="Close" onClick={() => setOpen(false)} />
      </Modal.Actions>
    </Modal>
  );
}

function UrlForm({ onSubmit }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();
  return (
    <Container>
      <Form onSubmit={handleSubmit(onSubmit)}>
        <Form.Field>
          <label>Issue URL</label>
          <input
            placeholder="https://github.com/john/myproject/issues/123"
            {...register("url", {
              required: "Required",
              pattern: {
                value: referenceUrlRegex,
                message: "Invalid GitHub issue or pull request URL",
              },
            })}
          />
          {errors.url && (
            <Label
              basic
              color="red"
              pointing
              prompt
              content={errors.url.message}
            />
          )}
        </Form.Field>
        <Form.Button type="submit">Submit</Form.Button>
      </Form>
    </Container>
  );
}

function AppMenu() {
  const { user, login, logout } = useGitHubAuth();
  return (
    <Menu vertical floated="right">
      {user ? (
        <Dropdown
          item
          direction="left"
          text={
            <div>
              <Image src={user.avatarUrl} avatar />
              {user?.login}
            </div>
          }
        >
          <Dropdown.Menu>
            <Dropdown.Item icon="sign-out" text="Logout" onClick={logout} />
          </Dropdown.Menu>
        </Dropdown>
      ) : (
        <Menu.Item onClick={login}>
          <Icon name="sign-in" />
          Login
        </Menu.Item>
      )}
    </Menu>
  );
}

function App() {
  const { isLoading, error, user } = useGitHubAuth();
  const [url, setUrl] = useParam(["url"]);
  return (
    <>
      {error ? <ErrorModal error={error} /> : null}
      <Dimmer active={isLoading}>
        <Loader />
      </Dimmer>
      {isLoading ? undefined : url ? (
        <Graph url={url} />
      ) : (
        <UrlForm
          onSubmit={({ url }) => {
            setUrl(url);
          }}
        />
      )}
      <AppMenu />
    </>
  );
}

const githubAuthClient = new GitHubAuthClient({
  clientId: "a2ae08b0ac8be98aa2ae",
  clientSecret: "994a627b52b2080b1eb5249d88bf21c91fc64bc5",
  async getUser(token) {
    const client = new GitHubClient({ token });
    const user = await client.getViewer();
    return { ...user, token };
  },
  scope: "repo",
});

function Root() {
  return (
    <GitHubAuthProvider githubAuthClient={githubAuthClient}>
      <App />
    </GitHubAuthProvider>
  );
}

ReactDOM.render(<Root />, document.getElementById("root"));

// async function run() {
//   client = new GitHubClient({ token });
//   const params = new URL(window.location.href).searchParams;
//   const initialUrl = params.get("url");
//   initialWork = { ...parseGitHubUrl(initialUrl), depth: 0 };
//   queue(initialWork);
//   worker();
// }
// run();
