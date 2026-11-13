pm.test("Status code is 201", function () {
  pm.response.to.have.status(201);
});

pm.test("Response adheres to RecipeMediaResponse array schema", function () {
  const jsonData = pm.response.json();
  pm.expect(jsonData).to.be.an("array");
  if (jsonData.length > 0) {
    const item = jsonData[0];
    pm.expect(item).to.have.property("id").that.is.a("number");
    pm.expect(item).to.have.property("url").that.is.a("string");
    pm.expect(item).to.have.property("type").that.is.a("string");
  }
});
