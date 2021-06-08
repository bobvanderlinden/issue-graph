const { GraphQLClient, gql } = require("./graphql-client");

class GitHubClient {
  constructor({ token }) {
    const graphqlUrl = "https://api.github.com/graphql";
    this.graphql = new GraphQLClient(graphqlUrl, {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
  }

  async getIssue({ owner, repo, number }) {
    const result = await this.graphql.request(
      gql`
        query ($owner: String!, $repo: String!, $number: Int!) {
          repository(owner: $owner, name: $repo) {
            issue(number: $number) {
              url
              title
              body
              state
              timelineItems(first: 100) {
                nodes {
                  ... on CrossReferencedEvent {
                    source {
                      ... on UniformResourceLocatable {
                        url
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
          }
        }
      `,
      { owner, repo, number }
    );
    return result.repository.issue;
  }

  async getPullRequest({ owner, repo, number }) {
    const result = await this.graphql.request(
      gql`
        query ($owner: String!, $repo: String!, $number: Int!) {
          repository(owner: $owner, name: $repo) {
            pullRequest(number: $number) {
              url
              title
              body
              state
              timelineItems(first: 100) {
                nodes {
                  ... on CrossReferencedEvent {
                    source {
                      ... on UniformResourceLocatable {
                        url
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
          }
        }
      `,
      { owner, repo, number }
    );
    return result.repository.pullRequest;
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
