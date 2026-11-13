pm.test("Status code is 200", function () {
  pm.response.to.have.status(200);
});

pm.test("Response body contains greeting string", function () {
  pm.expect(pm.response.text()).to.include("Hello World!");
});
