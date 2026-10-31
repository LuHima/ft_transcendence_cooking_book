pm.test("Status code is 200", function () {
  pm.response.to.have.status(200);
});

pm.test("Response adheres to NotificationListResponseDto schema", function () {
  const jsonData = pm.response.json();
  pm.expect(jsonData).to.be.an("object");
  pm.expect(jsonData).to.have.property("data").that.is.an("array");
  pm.expect(jsonData).to.have.property("total").that.is.a("number");
  pm.expect(jsonData).to.have.property("unread_count").that.is.a("number");
  if (jsonData.data.length > 0) {
    const item = jsonData.data[0];
    pm.expect(item).to.have.property("id").that.is.a("number");
    pm.expect(item).to.have.property("user_id").that.is.a("number");
    pm.expect(item).to.have.property("actor_id").that.is.a("number");
    pm.expect(item).to.have.property("subject").that.is.a("string");
    pm.expect(item).to.have.property("action").that.is.a("string");
    pm.expect(item).to.have.property("is_read").that.is.a("boolean");
    pm.expect(item).to.have.property("created_at").that.is.a("string");
  }
});
