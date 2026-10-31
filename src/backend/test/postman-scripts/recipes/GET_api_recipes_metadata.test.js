pm.test("Status code is 200", function () {
  pm.response.to.have.status(200);
});

pm.test("Response adheres to CatalogMetadataResponseDto schema", function () {
  const jsonData = pm.response.json();
  pm.expect(jsonData).to.be.an("object");
  pm.expect(jsonData).to.have.property("courses").that.is.an("array");
  pm.expect(jsonData).to.have.property("difficulties").that.is.an("array");
  pm.expect(jsonData).to.have.property("cooking_methods").that.is.an("array");
  pm.expect(jsonData).to.have.property("pricing_tiers").that.is.an("array");
  pm.expect(jsonData).to.have.property("units").that.is.an("array");
  pm.expect(jsonData).to.have.property("languages").that.is.an("array");
});
