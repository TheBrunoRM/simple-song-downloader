import path from "path";
console.log(path.join("E:\\", "/test/", "/downloaded/", "/yes/"));
console.log(path.resolve(process.cwd(), "yes"));
console.log(path.join(path.resolve("yes"), "/test/"));
console.log(path.join(path.resolve("yes"), "", "/test/", ""));
