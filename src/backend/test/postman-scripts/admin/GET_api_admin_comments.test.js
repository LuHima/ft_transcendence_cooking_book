pm.test("Status code is 200", function () {
  pm.response.to.have.status(200);
});

pm.test("Response contains paginated admin comment audit results", function () {
  const data = pm.response.json();
  pm.expect(data).to.have.property("items");
  pm.expect(data).to.have.property("total");
  pm.expect(data).to.have.property("page");
  pm.expect(data).to.have.property("limit");
  pm.expect(data).to.have.property("total_pages");
  pm.expect(data).to.have.property("has_next_page");
  pm.expect(data).to.have.property("has_prev_page");
  pm.expect(Array.isArray(data.items)).to.be.true;
});
