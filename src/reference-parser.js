// https://github.com/owner/repo/issues/number
// https://github.com/owner/repo/pull/number
const referenceUrlRegex =
  /https:\/\/github.com\/(?<urlOwner>[-a-zA-Z0-9_]+)\/(?<urlRepo>[-a-zA-Z0-9_]+)\/(?<urlType>issues|pull)\/(?<urlNumber>\d+)/;

// owner/repo#number
const referenceShortRegex =
  /(?<shortOwner>[-a-zA-Z0-9_]+)\/(?<shortRepo>[-a-zA-Z0-9_]+)#(?<shortNumber>\d+)/;

// #number
const referenceLocalRegex = /#(?<localNumber>\d+)/;

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}

class ReferenceParser {
  constructor(referenceTypes) {
    this.referenceTypes = referenceTypes;
    this.prefixLookup = Object.fromEntries(
      Object.entries(referenceTypes).flatMap(
        ([_id, referenceType]) =>
          referenceType.prefixes?.map((prefix) => [prefix, referenceType]) || []
      )
    );
    const referencePrefixRegex = new RegExp(
      Object.keys(this.prefixLookup)
        .filter((name) => escapeRegExp(name))
        .join("|")
    );

    // requires #number
    // superseded by: https://github.com/owner/repo/pull/number
    this.referenceRegex = new RegExp(
      `(?:(?<prefix>${referencePrefixRegex.source}):? )?(?:(?<short>${referenceShortRegex.source})|(?<local>${referenceLocalRegex.source})|(?<url>${referenceUrlRegex.source}))`,
      "ig"
    );
  }

  lookupReferenceTypeByPrefix(prefix) {
    if (!prefix) {
      return this.referenceTypes.default;
    }
    return this.prefixLookup[prefix.toLowerCase()];
  }

  getReferences({ source, text }) {
    return [...text.matchAll(this.referenceRegex)]
      .map((match) => {
        const groups = match.groups;
        const { prefix, short, local, url } = groups;

        const target = local
          ? {
              owner: source.owner,
              repo: source.repo,
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

        const referenceType = this.lookupReferenceTypeByPrefix(prefix);

        if (!referenceType) {
          return null;
        }

        return this.resolveAliases({
          referenceType,
          originalText: match[0],
          source,
          target,
        });
      })
      .filter((reference) => reference);
  }

  resolveAliases({ referenceType, source, target, ...rest }) {
    while (referenceType.alias) {
      if (referenceType.alias.reverse) {
        const tmp = target;
        target = source;
        source = tmp;
      }
      referenceType = this.referenceTypes[referenceType.alias.id];
    }
    return {
      referenceType,
      source,
      target,
      ...rest,
    };
  }
}

function parseGitHubUrl(url) {
  const match = referenceUrlRegex.exec(url);
  const { urlOwner: owner, urlRepo: repo, urlNumber: number } = match.groups;
  return {
    owner,
    repo,
    number: parseInt(number, 10),
  };
}

module.exports = {
  referenceUrlRegex,
  ReferenceParser,
  parseGitHubUrl,
};
