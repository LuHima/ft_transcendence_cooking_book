pm.test("Status code is 201", function () {
  pm.response.to.have.status(201);
});
pm.test("Response adheres to SignUpResponseDto", function () {
  const data = pm.response.json();
  pm.expect(data).to.have.property("id").that.is.a("number");
  pm.expect(data).to.have.property("username").that.is.a("string");
  pm.expect(data).to.have.property("email").that.is.a("string");
  pm.expect(data).to.have.property("role").that.is.a("string");
  pm.expect(data).to.have.property("avatar_url");
});
