import app = require("./app");

const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  console.log(`Sweety API listening on port ${port}`);
});
