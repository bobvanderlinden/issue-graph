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

  start(concurrency = 1, batchSize = 10) {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();
    for (let i = 0; i < concurrency; i++) {
      this.worker(this.abortController.signal, batchSize);
    }
  }

  stop() {
    this.abortController.abort();
  }

  async worker(signal, batchSize) {
    while (this.workQueue.length && !signal.aborted) {
      const works = this.getWorkBatch(batchSize);
      await this.handleWorks(works);
    }
  }

  getWorkBatch(batchSize) {
    const works = [];
    while (works.length < batchSize && this.workQueue.length) {
      works.push(this.workQueue.pop());
    }
    return works;
  }

  async handleWork(work) {
    const [{ data, error }] = await this.fetchWorks([work]);

    if (error) {
      this.dispatchEvent(new NodeErrorEvent(work, error));
      return;
    }

    this.handleWorkData(work, data);
  }

  async handleWorks(works) {
    const results = await this.fetchWorks(works);

    for (let index = 0; index < works.length; index++) {
      const work = works[index];
      const { data, error } = results[index];

      if (error) {
        this.dispatchEvent(new NodeErrorEvent(work, error));
        continue;
      }

      this.handleWorkData(work, data);
    }
  }

  async fetchWorks(works) {
    const { data, error } = await tryCatch(
      async () => ({
        data: await this.client.getIssueOrPullRequests(works),
      }),
      async (error) => ({ error })
    );

    if (error) {
      return works.map(() => ({ error }));
    }

    return data;
  }

  handleWorkData(work, data) {
    const { owner, repo, number, depth } = work;
    const current = {
      owner,
      repo,
      number,
    };

    this.dispatchEvent(new NodeFoundEvent({ owner, repo, number, ...data }));

    for (const timelineItem of data.timelineItems.nodes) {
      const source = timelineItem.source;
      const owner = source.repository.owner.login;
      const repo = source.repository.name;
      const number = source.number;
      this.queue({ owner, repo, number, source: work, depth: depth + 1 });
    }

    const subissueType = this.referenceParser.referenceTypes.subissue;

    // GitHub native sub-issue relationships. The edge always points from the
    // parent to the sub-issue (parent depends on / contains the sub-issue).
    if (data.parent) {
      const parent = {
        owner: data.parent.repository.owner.login,
        repo: data.parent.repository.name,
        number: data.parent.number,
      };
      this.queue({ ...parent, source: work, depth: depth + 1 });
      this.dispatchEvent(
        new ReferenceFoundEvent({
          referenceType: subissueType,
          source: parent,
          target: current,
        })
      );
    }

    if (data.subIssues) {
      for (const subIssue of data.subIssues.nodes) {
        const target = {
          owner: subIssue.repository.owner.login,
          repo: subIssue.repository.name,
          number: subIssue.number,
        };
        this.queue({ ...target, source: work, depth: depth + 1 });
        this.dispatchEvent(
          new ReferenceFoundEvent({
            referenceType: subissueType,
            source: current,
            target,
          })
        );
      }
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
