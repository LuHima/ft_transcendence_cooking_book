pm.test("Status code is 200", function () {
  pm.response.to.have.status(200);
});
pm.test("Response adheres to AuthMessageResponseDto", function () {
  const data = pm.response.json();
  pm.expect(data).to.have.property("message").that.is.a("string");
});
