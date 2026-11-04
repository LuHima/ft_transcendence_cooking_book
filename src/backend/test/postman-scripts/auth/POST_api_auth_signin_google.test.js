pm.test("Status code is 200", function () {
  pm.response.to.have.status(200);
});

pm.test(
  "Response adheres to AuthMessageResponseDto or TwoFactorChallengeResponseDto schema",
  function () {
    const jsonData = pm.response.json();
    pm.expect(jsonData).to.be.an("object");
    pm.expect(jsonData).to.have.property("message").that.is.a("string");
    if (jsonData.tempToken) {
      pm.expect(jsonData.tempToken).to.be.a("string");
    }
  },
);

// Extract accessToken from cookie, Set-Cookie header, or body
let accessToken = pm.cookies.get("accessToken");
if (!accessToken) {
  const setCookieHeaders = pm.response.headers
    .all()
    .filter((h) => h.key.toLowerCase() === "set-cookie");
  for (const h of setCookieHeaders) {
    const match = h.value.match(/accessToken=([^;]+)/);
    if (match) {
      accessToken = match[1];
      break;
    }
  }
}
if (!accessToken) {
  try {
    const data = pm.response.json();
    accessToken = data.accessToken || data.access_token;
  } catch (e) {}
}
if (accessToken) {
  pm.environment.set("accessToken", accessToken);
  console.log("accessToken successfully set in environment");
}

// Extract refreshToken from cookie (refresh_token or refreshToken), Set-Cookie header, or body
let refreshToken =
  pm.cookies.get("refresh_token") || pm.cookies.get("refreshToken");
if (!refreshToken) {
  const setCookieHeaders = pm.response.headers
    .all()
    .filter((h) => h.key.toLowerCase() === "set-cookie");
  for (const h of setCookieHeaders) {
    const match =
      h.value.match(/refresh_token=([^;]+)/) ||
      h.value.match(/refreshToken=([^;]+)/);
    if (match) {
      refreshToken = match[1];
      break;
    }
  }
}
if (!refreshToken) {
  try {
    const data = pm.response.json();
    refreshToken = data.refreshToken || data.refresh_token;
  } catch (e) {}
}
if (refreshToken) {
  pm.environment.set("refreshToken", refreshToken);
  console.log("refreshToken successfully set in environment");
}
