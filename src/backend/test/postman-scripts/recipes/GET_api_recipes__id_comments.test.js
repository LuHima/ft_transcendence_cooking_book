pm.test("Status code is 200", function () {
  pm.response.to.have.status(200);
});

pm.test(
  "Response adheres to ThreadedRecipeCommentResponseDto array schema",
  function () {
    const jsonData = pm.response.json();
    pm.expect(jsonData).to.be.an("array");
    if (jsonData.length > 0) {
      const comment = jsonData[0];
      pm.expect(comment).to.have.property("id").that.is.a("number");
      pm.expect(comment).to.have.property("recipe_id").that.is.a("number");
      pm.expect(comment).to.have.property("user_id").that.is.a("number");
      pm.expect(comment).to.have.property("content").that.is.a("string");
      pm.expect(comment).to.have.property("replies").that.is.an("array");
    }
  },
);
