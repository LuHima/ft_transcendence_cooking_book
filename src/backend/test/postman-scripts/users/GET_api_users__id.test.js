pm.test("Status code is 200", function () {
  pm.response.to.have.status(200);
});

pm.test("Response adheres to PublicUserResponseDto schema", function () {
  const jsonData = pm.response.json();
  pm.expect(jsonData).to.be.an("object");
  pm.expect(jsonData).to.have.property("id").that.is.a("number");
  pm.expect(jsonData).to.have.property("username").that.is.a("string");
  pm.expect(jsonData).to.have.property("created_at").that.is.a("string");
  if (jsonData.avatar_url !== null) {
    pm.expect(jsonData.avatar_url).to.be.a("string");
  }
});
