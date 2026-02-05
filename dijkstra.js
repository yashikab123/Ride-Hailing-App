async function loadGraphData() {
  const [nodesRes, graphRes] = await Promise.all([
    fetch('nodes.json'),
    fetch('graph.json')
  ]);

  const nodes = await nodesRes.json();
  const graph = await graphRes.json();
  return { nodes, graph };
}

function dijkstra(graph, startNode, endNode) {
  const distances = {};
  const previous = {};
  const visited = new Set();
  const pq = new MinPriorityQueue(); // You can use a simple array or a heap lib

  Object.keys(graph).forEach(node => {
    distances[node] = Infinity;
    previous[node] = null;
  });

  distances[startNode] = 0;
  pq.enqueue(startNode, 0);

  while (!pq.isEmpty()) {
    const { element: current } = pq.dequeue();

    if (visited.has(current)) continue;
    visited.add(current);

    if (current === endNode) break;

    for (const [neighbor, cost] of graph[current]) {
      const newDist = distances[current] + cost;
      if (newDist < distances[neighbor]) {
        distances[neighbor] = newDist;
        previous[neighbor] = current;
        pq.enqueue(neighbor, newDist);
      }
    }
  }

  // Reconstruct path
  const path = [];
  let currentNode = endNode;
  while (currentNode) {
    path.unshift(currentNode);
    currentNode = previous[currentNode];
  }

  return path;
}
