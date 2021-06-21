const params = require("./query-params");

function uuidv4() {
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
    (
      c ^
      (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
    ).toString(16)
  );
}

class GitHubAuthClient {
  constructor({ clientId, clientSecret, getUser, scope = "repo" }) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.scope = scope;
    this.getUser = getUser;
  }

  async storedAuthentication() {
    const storedToken = window.localStorage.getItem("github_access_token");
    if (!storedToken) {
      return null;
    }
    return await this.getUser(storedToken);
  }

  async personalAccessTokenAuthentication() {
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(url.hash.slice(1));
    const token = hash.get("token");
    if (!token) {
      return null;
    }
    const result = await this.getUser(token);
    if (result) {
      // Remove token from URL if it is valid.
      hash.delete("token");
      url.hash = hash.toString();
      window.history.replaceState(
        window.history.state,
        document.title,
        url.toString()
      );

      window.localStorage.setItem("github_access_token", token);
    }
    return result;
  }

  async oauthCallbackAuthentication() {
    const [code, state] = params.getAll(["code", "state"]);

    if (!code) {
      return null;
    }

    const storedState = window.localStorage.getItem("github_oauth_state");
    if (storedState !== state) {
      throw new Error("OAuth error: invalid state");
    }

    const parameters = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
    });
    const response = await fetch(
      "https://d5pweeyzg2.execute-api.us-east-1.amazonaws.com/login/oauth/access_token",
      {
        method: "POST",
        mode: "cors",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: parameters.toString(),
      }
    );
    const responseParams = new URLSearchParams(await response.text());
    const error = responseParams.get("error");
    if (error) {
      params.merge({ code: null, state: null });
      const errorDescription = responseParams.get("error_description");
      throw new Error(`OAuth error: ${error}: ${errorDescription}`);
    }
    const token = responseParams.get("access_token");

    window.localStorage.removeItem("github_oauth_state");

    // Make sure the URL doesn't show the code and state anymore.
    // Using the history API avoids doing a redirect.
    params.merge({ code: null, state: null });

    const result = await this.getUser(token);
    if (result) {
      window.localStorage.setItem("github_access_token", token);
    }
    return result;
  }

  async authenticate() {
    const url = new URL(window.location.href);

    const attempts = [
      () => this.oauthCallbackAuthentication(),
      () => this.personalAccessTokenAuthentication(),
      () => this.storedAuthentication(),
    ];

    for (const attempt of attempts) {
      const result = await attempt();
      if (result) {
        return result;
      }
    }
    return null;
  }

  login() {
    const state = uuidv4();
    window.localStorage.setItem("github_oauth_state", state);

    const redirect_uri = window.location.href;

    const parameters = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: redirect_uri.toString(),
      scope: this.scope,
      state,
    });
    window.location.href = `https://github.com/login/oauth/authorize?${parameters.toString()}`;
  }

  logout() {
    window.localStorage.removeItem("github_access_token");
  }
}

module.exports = {
  GitHubAuthClient,
};
