pm.test("Status code is 200", function () {
  pm.response.to.have.status(200);
});

pm.test("Response adheres to PaginatedAdminIngredientsResponseDto schema", function () {
  const jsonData = pm.response.json();
  pm.expect(jsonData).to.have.property("items").that.is.an("array");
  pm.expect(jsonData).to.have.property("total").that.is.a("number");
  pm.expect(jsonData).to.have.property("page").that.is.a("number");
  pm.expect(jsonData).to.have.property("limit").that.is.a("number");
  pm.expect(jsonData).to.have.property("total_pages").that.is.a("number");
  pm.expect(jsonData).to.have.property("has_next_page").that.is.a("boolean");
  pm.expect(jsonData).to.have.property("has_prev_page").that.is.a("boolean");

  if (jsonData.items.length > 0) {
    const item = jsonData.items[0];
    pm.expect(item).to.have.property("id").that.is.a("number");
    pm.expect(item).to.have.property("slug").that.is.a("string");
    pm.expect(item).to.have.property("category").that.is.a("string");
    pm.expect(item).to.have.property("translations").that.is.an("object");
    pm.expect(item.translations).to.have.property("it").that.is.a("string");
    pm.expect(item.translations).to.have.property("en").that.is.a("string");
    pm.expect(item.translations).to.have.property("fr").that.is.a("string");
  }
});
