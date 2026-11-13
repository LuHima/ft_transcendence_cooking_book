pm.test("Status code is 200", function () {
  pm.response.to.have.status(200);
});

pm.test("Response adheres to UserProfileResponseDto schema", function () {
  const jsonData = pm.response.json();
  pm.expect(jsonData).to.be.an("object");
  pm.expect(jsonData).to.have.property("id").that.is.a("number");
  pm.expect(jsonData).to.have.property("username").that.is.a("string");
  pm.expect(jsonData).to.have.property("email").that.is.a("string");
  pm.expect(jsonData).to.have.property("role").that.is.a("string");
  pm.expect(jsonData).to.have.property("first_name").that.is.a("string");
  pm.expect(jsonData).to.have.property("last_name").that.is.a("string");
  pm.expect(jsonData).to.have.property("created_at").that.is.a("string");
});
