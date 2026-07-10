const { GraphQLClient, gql } = require("./graphql-client");

const issueOrPullRequestFields = `
  ... on UniformResourceLocatable {
    url
  }

  ... on PullRequest {
    pullRequestState: state
    isDraft
    title
    body
    author {
      login
      avatarUrl
    }
    timelineItems(first: 100, itemTypes: [CROSS_REFERENCED_EVENT]) {
      nodes {
        ... on CrossReferencedEvent {
          source {
            ... on Issue {
              repository {
                owner {
                  login
                }
                name
              }
              number
            }

            ... on PullRequest {
              repository {
                owner {
                  login
                }
                name
              }
              number
            }
          }
        }
      }
    }
    comments(first: 100) {
      nodes {
        author {
          url
        }
        body
      }
    }
  }

  ... on Issue {
    issueState: state
    parent {
      repository {
        owner {
          login
        }
        name
      }
      number
    }
    subIssues(first: 100) {
      nodes {
        repository {
          owner {
            login
          }
          name
        }
        number
      }
    }
    title
    body
    author {
      login
      avatarUrl
    }
    timelineItems(first: 100, itemTypes: [CROSS_REFERENCED_EVENT]) {
      nodes {
        ... on CrossReferencedEvent {
          source {
            ... on Issue {
              repository {
                owner {
                  login
                }
                name
              }
              number
            }

            ... on PullRequest {
              repository {
                owner {
                  login
                }
                name
              }
              number
            }
          }
        }
      }
    }
    comments(first: 100) {
      nodes {
        author {
          url
        }
        body
      }
    }
  }
`;

class GitHubClient {
  constructor({ token }) {
    const graphqlUrl = "https://api.github.com/graphql";
    const headers = token ? { authorization: `token ${token}` } : {};
    this.graphql = new GraphQLClient(graphqlUrl, {
      headers,
    });
  }

  async getViewer() {
    const result = await this.graphql.request(gql`
      query {
        viewer {
          name
          login
          avatarUrl
        }
      }
    `);
    return result.viewer;
  }

  async getIssueOrPullRequest({ owner, repo, number }) {
    const [{ data, error }] = await this.getIssueOrPullRequests([
      { owner, repo, number },
    ]);
    if (error) {
      throw error;
    }
    return data;
  }

  async getIssueOrPullRequests(items) {
    if (!items.length) {
      return [];
    }

    const variableDefinitions = [];
    const repositories = [];
    const variables = {};

    items.forEach(({ owner, repo, number }, index) => {
      variableDefinitions.push(
        `$owner${index}: String!`,
        `$repo${index}: String!`,
        `$number${index}: Int!`
      );
      repositories.push(`
        item${index}: repository(owner: $owner${index}, name: $repo${index}) {
          issueOrPullRequest(number: $number${index}) {
            ${issueOrPullRequestFields}
          }
        }
      `);
      variables[`owner${index}`] = owner;
      variables[`repo${index}`] = repo;
      variables[`number${index}`] = number;
    });

    const result = await this.graphql.rawRequest(
      gql`
        query (${variableDefinitions.join(", ")}) {
          ${repositories.join("\n")}
        }
      `,
      variables
    );

    const itemErrors = new Map();
    const globalErrors = [];
    for (const error of result.errors || []) {
      const alias = error.path && error.path[0];
      if (typeof alias === "string" && alias.startsWith("item")) {
        const errors = itemErrors.get(alias) || [];
        errors.push(error);
        itemErrors.set(alias, errors);
      } else {
        globalErrors.push(error);
      }
    }

    if (globalErrors.length) {
      this.graphql.checkResult({ ...result, errors: globalErrors });
    }

    return items.map(({ owner, repo, number }, index) => {
      const alias = `item${index}`;
      const errors = itemErrors.get(alias);
      if (errors) {
        return {
          error: new Error(
            `GraphQL query resulted in the following errors:\n${errors
              .map(({ message }) => `* ${message}`)
              .join("\n")}`
          ),
        };
      }

      const item = result.data && result.data[alias];
      if (!item || !item.issueOrPullRequest) {
        return {
          error: new Error(`Unable to fetch ${owner}/${repo}#${number}`),
        };
      }

      return {
        data: item.issueOrPullRequest,
      };
    });
  }

  getRepositories({ organization }) {
    return this.paginate(async (cursor) => {
      const result = await this.graphql.request(
        gql`
          query ($organization: String!, $cursor: String) {
            organization(login: $organization) {
              repositories(first: 10, after: $cursor) {
                edges {
                  node {
                    id
                    databaseId
                    url
                    name
                    description
                    homepageUrl
                    isArchived
                    isDisabled
                    isEmpty
                    isFork
                    isLocked
                    isMirror
                    isPrivate
                    updatedAt
                    pushedAt
                  }
                }
                pageInfo {
                  endCursor
                  hasNextPage
                }
              }
            }
          }
        `,
        { organization, cursor }
      );
      return result.organization.repositories;
    });
  }

  getIssues({ owner, repo }) {
    return this.paginate(async (cursor) => {
      const result = await this.graphql.request(
        gql`
          query ($owner: String!, $repo: String!, $cursor: String) {
            repository(owner: $owner, name: $repo) {
              issues(first: 100, after: $cursor) {
                pageInfo {
                  endCursor
                  hasNextPage
                }
                edges {
                  node {
                    repository {
                      url
                    }
                    id
                    databaseId
                    url
                    title
                    body
                    state
                    updatedAt
                    createdAt
                    author {
                      url
                    }
                  }
                }
              }
            }
          }
        `,
        { owner, repo, cursor }
      );
      return result.repository.issues;
    });
  }

  getPullRequests({ owner, repo }) {
    return this.paginate(async (cursor) => {
      const result = await this.graphql.request(
        gql`
          query ($owner: String!, $repo: String!, $cursor: String) {
            repository(owner: $owner, name: $repo) {
              pullRequests(first: 100, after: $cursor) {
                pageInfo {
                  endCursor
                  hasNextPage
                }
                edges {
                  node {
                    repository {
                      url
                    }
                    id
                    databaseId
                    url
                    title
                    body
                    state
                    updatedAt
                    createdAt
                    author {
                      url
                    }
                  }
                }
              }
            }
          }
        `,
        { owner, repo, cursor }
      );
      return result.repository.pullRequests;
    });
  }

  getTeams({ organization }) {
    return this.paginate(async (cursor) => {
      const result = await this.graphql.rawRequest(
        gql`
          query ($organization: String!, $cursor: String) {
            organization(login: $organization) {
              teams(first: 10, after: $cursor) {
                edges {
                  node {
                    id
                    url
                    name
                    slug
                    updatedAt
                    createdAt
                    parentTeam {
                      url
                    }
                    repositories(first: 100) {
                      edges {
                        permission
                        node {
                          url
                        }
                      }
                    }
                    members(first: 100, membership: IMMEDIATE) {
                      edges {
                        role
                        node {
                          url
                        }
                      }
                    }
                  }
                }
                pageInfo {
                  endCursor
                  hasNextPage
                }
              }
            }
          }
        `,
        { organization, cursor }
      );

      if (result.errors) {
        result.errors = result.errors.filter(({ type }) => type !== "INTERNAL");
      }
      this.graphql.checkResult(result);
      if (result.data.organization.teams.edges) {
        result.data.organization.teams.edges =
          result.data.organization.teams.edges.filter(({ node }) => node);
      }
      return result.data.organization.teams;
    });
  }

  getUsers({ organization }) {
    return this.paginate(async (cursor) => {
      const result = await this.graphql.request(
        gql`
          query ($organization: String!, $cursor: String) {
            organization(login: $organization) {
              membersWithRole(first: 100, after: $cursor) {
                edges {
                  role
                  node {
                    id
                    databaseId
                    name
                    login
                    url
                    updatedAt
                    createdAt
                  }
                }
                pageInfo {
                  endCursor
                  hasNextPage
                }
              }
            }
          }
        `,
        { organization, cursor }
      );
      return result.organization.membersWithRole;
    });
  }

  async *paginate(queryFn) {
    let after = null;
    do {
      const { pageInfo, edges } = await queryFn(after);
      for (const edge of edges) {
        yield edge;
      }
      after = pageInfo.hasNextPage ? pageInfo.endCursor : null;
    } while (after);
  }
}

module.exports = {
  GitHubClient,
};
