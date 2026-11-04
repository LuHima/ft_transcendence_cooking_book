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

pm.test("Recipe cards contain multi-criteria attributes", function () {
  const jsonData = pm.response.json();
  const items = jsonData.items || jsonData.data || [];
  if (items.length > 0) {
    const card = items[0];
    pm.expect(card).to.have.property("id").that.is.a("number");
    pm.expect(card).to.have.property("title").that.is.a("string");
    pm.expect(card).to.have.property("total_time").that.is.a("number");
    pm.expect(card).to.have.property("difficulty").that.is.a("string");
    pm.expect(card).to.have.property("likes_count").that.is.a("number");
  }
});
