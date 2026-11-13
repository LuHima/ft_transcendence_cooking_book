pm.test("Status code is 200", function () {
  pm.response.to.have.status(200);
});

pm.test(
  "Response adheres to PaginatedRecipeCommentsResponseDto schema",
  function () {
    const jsonData = pm.response.json();
    pm.expect(jsonData).to.be.an("object");
    pm.expect(jsonData).to.have.property("items").that.is.an("array");
    pm.expect(jsonData).to.have.property("total").that.is.a("number");
    pm.expect(jsonData).to.have.property("page").that.is.a("number");
    pm.expect(jsonData).to.have.property("limit").that.is.a("number");
    pm.expect(jsonData).to.have.property("total_pages").that.is.a("number");
    pm.expect(jsonData).to.have.property("has_next_page").that.is.a("boolean");
    pm.expect(jsonData).to.have.property("has_prev_page").that.is.a("boolean");

    if (jsonData.items.length > 0) {
      const comment = jsonData.items[0];
      pm.expect(comment).to.have.property("id").that.is.a("number");
      pm.expect(comment).to.have.property("recipe_id").that.is.a("number");
      pm.expect(comment).to.have.property("replies_count").that.is.a("number");
      pm.expect(comment).to.have.property("has_more_replies").that.is.a("boolean");
      pm.expect(comment).to.have.property("replies").that.is.an("array");
    }
  },
);
