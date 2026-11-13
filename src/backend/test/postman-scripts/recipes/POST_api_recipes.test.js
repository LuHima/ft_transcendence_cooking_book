pm.test("Status code is 201", function () {
  pm.response.to.have.status(201);
});

pm.test(
  "Response adheres to LocalizedRecipeDetailResponse schema",
  function () {
    const jsonData = pm.response.json();
    pm.expect(jsonData).to.be.an("object");
    pm.expect(jsonData).to.have.property("id").that.is.a("number");
    pm.expect(jsonData).to.have.property("title").that.is.a("string");
    pm.expect(jsonData).to.have.property("author_id").that.is.a("number");
    pm.expect(jsonData).to.have.property("course").that.is.a("string");
    pm.expect(jsonData).to.have.property("difficulty").that.is.a("string");
  },
);
