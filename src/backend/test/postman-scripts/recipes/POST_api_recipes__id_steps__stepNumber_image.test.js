pm.test("Status code is 201", function () {
  pm.response.to.have.status(201);
});

pm.test("Response adheres to StepImageUploadResponseDto schema", function () {
  const jsonData = pm.response.json();
  pm.expect(jsonData).to.be.an("object");
  pm.expect(jsonData).to.have.property("step_image_url").that.is.a("string");
  pm.expect(jsonData).to.have.property("message").that.is.a("string");
});
