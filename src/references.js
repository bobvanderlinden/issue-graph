const defaultReferenceType = "refers";

const referenceTypes = {
  refers: ["refers", "refer", "reference"],
  requires: ["requires", "depends on", "depends", "needs"],
  required_by: ["required by", "needed by"],
  resolves: ["resolve", "resolves", "resolved"],
  closes: ["close", "closes", "closed"],
  fixes: ["fixes", "fix", "fixed"],
  part_of: ["part of"],
  superseded_by: ["superseded by"],
};

const referenceLookup = Object.fromEntries(
  Object.entries(referenceTypes).flatMap(([type, names]) =>
    names.map((name) => [name, type])
  )
);

const referenceLookupRegex = new RegExp(
  Object.keys(referenceLookup)
    .filter((name) => name)
    .join("|")
);

// https://github.com/owner/repo/issues/number
// https://github.com/owner/repo/pull/number
const referenceUrlRegex =
  /https:\/\/github.com\/(?<urlOwner>[-a-zA-Z0-9_]+)\/(?<urlRepo>[-a-zA-Z0-9_]+)\/(?<urlType>issues|pull)\/(?<urlNumber>\d+)/;

// owner/repo#number
const referenceShortRegex =
  /(?<shortOwner>[-a-zA-Z0-9_]+)\/(?<shortRepo>[-a-zA-Z0-9_]+)#(?<shortNumber>\d+)/;

// #number
const referenceLocalRegex = /#(?<localNumber>\d+)/;

// requires #number
// superseded by: https://github.com/owner/repo/pull/number
const referenceRegex = new RegExp(
  `(?:(?<name>${referenceLookupRegex.source}):? )?(?:(?<short>${referenceShortRegex.source})|(?<local>${referenceLocalRegex.source})|(?<url>${referenceUrlRegex.source}))`,
  "ig"
);

function parseGitHubUrl(url) {
  const match = referenceUrlRegex.exec(url);
  const { urlOwner: owner, urlRepo: repo, urlNumber: number } = match.groups;
  return {
    owner,
    repo,
    number: parseInt(number, 10),
  };
}

function getReferences({ owner: parentOwner, repo: parentRepo, text }) {
  return [...text.matchAll(referenceRegex)].map((match) => {
    const groups = match.groups;
    const { name, short, local, url } = groups;

    const { owner, repo, number } = local
      ? {
          owner: parentOwner,
          repo: parentRepo,
          number: parseInt(groups.localNumber, 10),
        }
      : short
      ? {
          owner: groups.shortOwner,
          repo: groups.shortRepo,
          number: parseInt(groups.shortNumber, 10),
        }
      : url
      ? {
          owner: groups.urlOwner,
          repo: groups.urlRepo,
          number: parseInt(groups.urlNumber, 10),
        }
      : null;

    const referenceName =
      (name && referenceLookup[name.toLowerCase()]) || defaultReferenceType;

    return {
      name: referenceName,
      target: {
        owner,
        repo,
        number,
      },
    };
  });
}

module.exports = {
  parseGitHubUrl,
  getReferences,
};
