const axios = require("axios");

const api = axios.create({
  baseURL: "https://api.spotify.com/v1/",
});

module.exports = api;
