const url = new URL(window.location.href);
const code = url.searchParams.get("code");
const state = url.searchParams.get("state");

const client_id = "a2ae08b0ac8be98aa2ae";
const client_secret = "994a627b52b2080b1eb5249d88bf21c91fc64bc5";
const redirect_uri = "https://bobvanderlinden.github.io/issue-graph/";

async function authorize(code) {
  const parameters = new URLSearchParams({
    client_id,
    client_secret,
    code,
  });
  const response = await fetch({
    method: "POST",
    url: "https://github.com/login/oauth/access_token",
    mode: "cors",
    body: parameters.toString(),
  });
  const result = new URLSearchParams(await response.text());
  const { access_token, token_type } = result;

  console.log(token_type, access_token);
}

if (code) {
  authorize(code);
}

const button = document.createElement("button");
button.textContent = "authorize";
button.onclick = () => {
  const parameters = new URLSearchParams({
    client_id,
    client_secret,
    redirect_uri,
    scope: "repo",
    state: "123",
  });
  window.location.href = `https://github.com/login/oauth/authorize?${parameters.toString()}`;
};
document.body.appendChild(button);
