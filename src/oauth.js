const client_id = "a2ae08b0ac8be98aa2ae";
const client_secret = "994a627b52b2080b1eb5249d88bf21c91fc64bc5";

async function authorize(code) {
  const parameters = new URLSearchParams({
    client_id,
    client_secret,
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
  const text = await response.text();
  const result = new URLSearchParams(text);
  if (result.get("error")) {
    const url = new URL(window.location.href);
    const redirect_uri = new URL(
      window.location.origin + window.location.pathname
    );

    redirect_uri.searchParams.set("url", url.searchParams.get("url"));
    window.location.href = redirect_uri.toString();
    return null;
  }
  return result.get("access_token");
}

async function getAccessToken() {
  const url = new URL(window.location.href);

  const token = url.searchParams.get("token");
  if (token) {
    return token;
  }

  const code = url.searchParams.get("code");

  if (code) {
    return await authorize(code);
  }

  const state = url.searchParams.get("state");

  const redirect_uri = new URL(
    window.location.origin + window.location.pathname
  );
  redirect_uri.searchParams.set("url", url.searchParams.get("url"));

  const parameters = new URLSearchParams({
    client_id,
    client_secret,
    redirect_uri: redirect_uri.toString(),
    scope: "repo",
    state: "",
  });
  window.location.href = `https://github.com/login/oauth/authorize?${parameters.toString()}`;
  return null;
}

module.exports = {
  getAccessToken,
};
