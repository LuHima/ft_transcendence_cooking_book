pm.test("Status code is 200", function () {
  pm.response.to.have.status(200);
});

pm.test("Response adheres to PaginatedFriendsResponseDto schema", function () {
  const jsonData = pm.response.json();
  pm.expect(jsonData).to.be.an("object");
  pm.expect(jsonData).to.have.property("data").that.is.an("array");
  pm.expect(jsonData).to.have.property("meta").that.is.an("object");
  pm.expect(jsonData.meta).to.have.property("page").that.is.a("number");
  pm.expect(jsonData.meta).to.have.property("limit").that.is.a("number");
  pm.expect(jsonData.meta).to.have.property("total").that.is.a("number");
  pm.expect(jsonData.meta).to.have.property("totalPages").that.is.a("number");
});
