pm.test("Status code is 200", function () {
  pm.response.to.have.status(200);
});

pm.test(
  "Response adheres to IngredientDetailResponseDto schema",
  function () {
    const jsonData = pm.response.json();
    pm.expect(jsonData).to.be.an("object");
    pm.expect(jsonData).to.have.property("id").that.is.a("number");
    pm.expect(jsonData).to.have.property("slug").that.is.a("string");
    pm.expect(jsonData).to.have.property("category").that.is.a("string");
    pm.expect(jsonData).to.have.property("translations").that.is.an("object");
    pm.expect(jsonData.translations).to.have.property("it").that.is.a("string");
    pm.expect(jsonData.translations).to.have.property("en").that.is.a("string");
    pm.expect(jsonData.translations).to.have.property("fr").that.is.a("string");
  },
);
