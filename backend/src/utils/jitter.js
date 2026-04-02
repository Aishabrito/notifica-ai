
module.exports = {
  // Faz o código esperar um tempo aleatório entre um mínimo e um máximo
  wait: (min = 2000, max = 5000) => {
    const ms = Math.floor(Math.random() * (max - min + 1) + min);
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};