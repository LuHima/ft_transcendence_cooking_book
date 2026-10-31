pm.test("Status code is 200", function () {
  pm.response.to.have.status(200);
});

pm.test("Response adheres to TwoFactorEnableResponseDto schema", function () {
  const jsonData = pm.response.json();
  pm.expect(jsonData).to.be.an("object");
  pm.expect(jsonData).to.have.property("qrCode");
  pm.expect(jsonData.qrCode).to.be.a("string");
  pm.expect(jsonData.qrCode).to.match(/^data:image\/png;base64,/);
  pm.expect(jsonData).to.have.property("key");
  pm.expect(jsonData.key).to.be.a("string");
});
