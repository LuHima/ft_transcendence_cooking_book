pm.test("Status code is 200", function () {
  pm.response.to.have.status(200);
});

pm.test("Response adheres to TagResponseDto array schema", function () {
  const jsonData = pm.response.json();
  pm.expect(jsonData).to.be.an("array");
  if (jsonData.length > 0) {
    const item = jsonData[0];
    pm.expect(item).to.have.property("id").that.is.a("number");
    pm.expect(item).to.have.property("slug").that.is.a("string");
    pm.expect(item).to.have.property("name").that.is.a("string");
  }
});
