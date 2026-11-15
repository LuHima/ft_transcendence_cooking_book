pm.test("Status code is 200", function () {
  pm.response.to.have.status(200);
});

pm.test("Response adheres to PaginatedBanHistoryResponseDto schema", function () {
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
    pm.expect(item).to.have.property("id").that.is.a("string");
    pm.expect(item).to.have.property("user_id").that.is.a("number");
    pm.expect(item).to.have.property("banned_by_id").that.is.a("number");
    pm.expect(item).to.have.property("report_id");
    pm.expect(item).to.have.property("action").that.is.a("string");
    pm.expect(item).to.have.property("reason").that.is.a("string");
    pm.expect(item).to.have.property("description");
    pm.expect(item).to.have.property("duration_days");
    pm.expect(item).to.have.property("is_permanent").that.is.a("boolean");
    pm.expect(item).to.have.property("banned_at").that.is.a("string");
    pm.expect(item).to.have.property("expires_at");
    pm.expect(item).to.have.property("unbanned_at");
    pm.expect(item).to.have.property("unbanned_by_id");
    pm.expect(item).to.have.property("unban_reason");
  }
});
