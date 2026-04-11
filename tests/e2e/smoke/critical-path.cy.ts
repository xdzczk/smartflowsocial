describe("Smoke: Critical Path", () => {
  it("loads the app root", () => {
    cy.visitAndCheck("/");
    cy.location("pathname").should("eq", "/");
    cy.get("body").should("be.visible");
  });

  it("redirects unauthenticated users away from dashboard", () => {
    cy.clearCookie("__session");
    cy.visit("/dashboard", { failOnStatusCode: false });
    cy.location("pathname").should("not.include", "/dashboard");
  });
});
