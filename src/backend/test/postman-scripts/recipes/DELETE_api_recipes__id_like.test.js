pm.test("Status code is 200", function () {
  pm.response.to.have.status(200);
});

pm.test("Response adheres to RecipeLikeResponseDto schema", function () {
  const jsonData = pm.response.json();
  pm.expect(jsonData).to.be.an("object");
  pm.expect(jsonData).to.have.property("liked").that.is.a("boolean");
  pm.expect(jsonData).to.have.property("likes_count").that.is.a("number");
  pm.expect(jsonData).to.have.property("message").that.is.a("string");
});
