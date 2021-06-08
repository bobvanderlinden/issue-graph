const defaultReferenceType = "refers";

const referenceTypes = {
  refers: ["refers", "refer", "reference"],
  requires: ["requires", "depends on", "depends", "needs"],
  required_by: ["required by", "needed by"],
  resolves: ["resolve", "resolves", "resolved"],
  closes: ["close", "closes", "closed"],
  fixes: ["fixes", "fix", "fixed"],
  part_of: ["part of"],
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
const referenceUrlRegex =
  /https:\/\/github.com\/(?<owner>[-a-zA-Z0-9_]+)\/(?<repo>[-a-zA-Z0-9_]+)\/(?<type>issues|pull)\/(?<number>\d+)/;
const referenceRegex = new RegExp(
  `(?:(?<name>${referenceLookupRegex.source}) )?(?<url>${referenceUrlRegex.source})`,
  "ig"
);

function parseGitHubUrl(url) {
  const match = referenceUrlRegex.exec(url);
  const { owner, repo, type, number } = match.groups;
  return {
    url: url,
    owner,
    repo,
    type: { issues: "GitHubIssue", pull: "GitHubPullRequest" }[type],
    number: parseInt(number, 10),
  };
}

function getReferences(text) {
  return [...text.matchAll(referenceRegex)].map((match) => {
    const { name, url, type, owner, repo, number } = match.groups;
    return {
      name:
        (name && referenceLookup[name.toLowerCase()]) || defaultReferenceType,
      url: url,
      owner,
      repo,
      type: { issues: "GitHubIssue", pull: "GitHubPullRequest" }[type],
      number: parseInt(number, 10),
    };
  });
}

module.exports = {
  parseGitHubUrl,
  getReferences,
};
