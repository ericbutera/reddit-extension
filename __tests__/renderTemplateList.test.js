const { renderTemplateList } = require("../src/options.js");

describe("renderTemplateList", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  test("renders items from template into container", () => {
    // create template
    const tpl = document.createElement("template");
    tpl.id = "tpl-test-item";
    tpl.innerHTML =
      '<li class="tpl-root"><span class="title" data-field="text"></span><span class="count" data-field="count"></span></li>';
    document.body.appendChild(tpl);

    // create container
    const ul = document.createElement("ul");
    ul.id = "testContainer";
    document.body.appendChild(ul);

    const items = [{ text: "alpha", count: "3", dataName: "alpha" }];

    renderTemplateList("#testContainer", "tpl-test-item", items);

    const children = ul.querySelectorAll("li");
    expect(children.length).toBe(1);
    const li = children[0];
    expect(li.querySelector(".title").textContent).toBe("alpha");
    expect(li.querySelector(".count").textContent).toBe("3");
    expect(li.dataset.name).toBe("alpha");
  });
});
