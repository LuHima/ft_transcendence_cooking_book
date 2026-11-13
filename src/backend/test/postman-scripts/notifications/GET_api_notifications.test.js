pm.test("Status code is 200", function () {
  pm.response.to.have.status(200);
});

pm.test("Response adheres to PaginatedNotificationResponseDto schema", function () {
  const jsonData = pm.response.json();
  pm.expect(jsonData).to.be.an("object");
  pm.expect(jsonData).to.have.property("items").that.is.an("array");
  pm.expect(jsonData).to.have.property("total").that.is.a("number");
  pm.expect(jsonData).to.have.property("page").that.is.a("number");
  pm.expect(jsonData).to.have.property("limit").that.is.a("number");
  pm.expect(jsonData).to.have.property("total_pages").that.is.a("number");
  pm.expect(jsonData).to.have.property("has_next_page").that.is.a("boolean");
  pm.expect(jsonData).to.have.property("has_prev_page").that.is.a("boolean");
  pm.expect(jsonData).to.have.property("unread_count").that.is.a("number");
  if (jsonData.items.length > 0) {
    const item = jsonData.items[0];
    pm.expect(item).to.have.property("id").that.is.a("number");
    pm.expect(item).to.have.property("user_id").that.is.a("number");
    pm.expect(item).to.have.property("actor").that.is.an("object");
    pm.expect(item.actor).to.have.property("id").that.is.a("number");
    pm.expect(item.actor).to.have.property("username").that.is.a("string");
    pm.expect(item).to.have.property("subject").that.is.a("string");
    pm.expect(item).to.have.property("action").that.is.a("string");
    pm.expect(item).to.have.property("target").that.is.an("object");
    pm.expect(item).to.have.property("message").that.is.a("string");
    pm.expect(item).to.have.property("is_read").that.is.a("boolean");
    pm.expect(item).to.have.property("created_at").that.is.a("string");
  }
});
