export class PixelWorkerClient {
  #worker;
  #requests = new Map();
  #nextId = 0;
  #failure = null;

  constructor(worker) {
    this.#worker = worker;
    worker.onmessage = ({ data }) => {
      const request = this.#requests.get(data.id);
      if (!request) return;
      this.#requests.delete(data.id);
      if (data.error) request.reject(new Error(data.error));
      else request.resolve(data);
    };
    worker.onerror = worker.onmessageerror = () => {
      this.#failure = new Error(
        "The image worker stopped. Reload the page to restart it.",
      );
      for (const request of this.#requests.values())
        request.reject(this.#failure);
      this.#requests.clear();
      worker.terminate();
    };
  }

  run(pixels, adjustments) {
    if (this.#failure) return Promise.reject(this.#failure);
    return new Promise((resolve, reject) => {
      const id = ++this.#nextId;
      this.#requests.set(id, { resolve, reject });
      try {
        this.#worker.postMessage({ id, pixels, adjustments }, [pixels.buffer]);
      } catch (error) {
        this.#requests.delete(id);
        reject(error);
      }
    });
  }
}
