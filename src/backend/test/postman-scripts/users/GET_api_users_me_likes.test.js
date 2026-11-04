pm.test("Status code is 200", function () {
  pm.response.to.have.status(200);
});

pm.test("Response adheres to PaginatedRecipeResponseDto schema", function () {
  const jsonData = pm.response.json();
  pm.expect(jsonData).to.be.an("object");
  const items = jsonData.items || jsonData.data;
  pm.expect(items).to.be.an("array");
  pm.expect(jsonData).to.have.property("total").that.is.a("number");
  pm.expect(jsonData).to.have.property("page").that.is.a("number");
  pm.expect(jsonData).to.have.property("limit").that.is.a("number");
  pm.expect(jsonData).to.have.property("total_pages").that.is.a("number");
  pm.expect(jsonData).to.have.property("has_next_page").that.is.a("boolean");
  pm.expect(jsonData).to.have.property("has_prev_page").that.is.a("boolean");
});
