pm.test("Status code is 200", function () {
  pm.response.to.have.status(200);
});

pm.test(
  "Response adheres to NotificationMessageResponseDto schema",
  function () {
    const jsonData = pm.response.json();
    pm.expect(jsonData).to.be.an("object");
    pm.expect(jsonData).to.have.property("message").that.is.a("string");
  },
);
