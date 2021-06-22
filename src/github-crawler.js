const { ReferenceParser } = require("./reference-parser");

async function tryCatch(tryer, catcher) {
  try {
    return await tryer();
  } catch (error) {
    return await catcher(error);
  }
}

export class NodeFoundEvent extends Event {
  constructor(node) {
    super("nodeFound");
    this.node = node;
  }
}

export class NodeErrorEvent extends Event {
  constructor(node, error) {
    super("nodeError");
    this.node = node;
    this.error = error;
  }
}

export class ReferenceFoundEvent extends Event {
  constructor(reference) {
    super("referenceFound");
    this.reference = reference;
  }
}

export class GitHubCrawler extends EventTarget {
  constructor({ client, referenceParser }) {
    super();
    this.client = client;
    this.lookup = {};
    this.workQueue = [];
    this.referenceParser = referenceParser;
  }

  queue(work) {
    const { owner, repo, number, depth } = work;
    console.assert(owner);
    console.assert(repo);
    console.assert(number);
    const id = `${owner}/${repo}#${number}`;
    if (this.lookup[id]) {
      if (this.lookup[id].depth > depth) {
        this.lookup[id].depth = depth;
        this.lookup[id][nodeSymbol].level = depth;
      }
      return;
    }
    this.lookup[id] = work;
    this.workQueue.unshift(work);
  }

  start(concurrency = 1) {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();
    for (let i = 0; i < concurrency; i++) {
      this.worker(this.abortController.signal);
    }
  }

  stop() {
    this.abortController.abort();
  }

  async worker(signal) {
    while (this.workQueue.length && !signal.aborted) {
      const work = this.workQueue.pop();
      await this.handleWork(work);
    }
  }

  async handleWork(work) {
    const { owner, repo, number, source, depth } = work;
    const current = {
      owner,
      repo,
      number,
    };
    const { data, error } = await tryCatch(
      async () => ({
        data: await this.client.getIssueOrPullRequest({ owner, repo, number }),
      }),
      async (error) => ({ error })
    );

    if (error) {
      this.dispatchEvent(new NodeErrorEvent(work, error));
      return;
    }

    this.dispatchEvent(new NodeFoundEvent({ owner, repo, number, ...data }));

    for (const timelineItem of data.timelineItems.nodes) {
      const source = timelineItem.source;
      const owner = source.repository.owner.login;
      const repo = source.repository.name;
      const number = source.number;
      this.queue({ owner, repo, number, source: work, depth: depth + 1 });
    }

    const references = this.referenceParser.getReferences({
      source: current,
      text: data.body,
    });
    for (const reference of references) {
      if (reference.follow) {
        this.queue({ ...reference.target, source: work, depth: depth + 1 });
      }
      this.dispatchEvent(new ReferenceFoundEvent(reference));
    }

    for (const comment of data.comments.nodes) {
      const references = this.referenceParser.getReferences({
        source: current,
        text: comment.body,
      });
      for (const reference of references) {
        if (reference.follow) {
          this.queue({
            ...reference.target,
            source: current,
            depth: depth + 1,
          });
        }
        this.dispatchEvent(new ReferenceFoundEvent(reference));
      }
    }
  }
}
