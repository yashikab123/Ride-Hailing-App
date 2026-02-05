import xml.etree.ElementTree as ET
from haversine import haversine, Unit
import json

# === Change this to your OSM file path ===
OSM_FILE = 'C:\\Users\\yashi\\Downloads\\planet_77.811,30.225_78.252,30.473.osm'

# Data structures
nodes = {}     # node_id: (lat, lon)
graph = {}     # node_id: [ (neighbor_id, cost), ... ]

# Parse the XML
tree = ET.parse(OSM_FILE)
root = tree.getroot()

# Step 1: Extract nodes
for node in root.findall('node'):
    node_id = node.attrib['id']
    lat = float(node.attrib['lat'])
    lon = float(node.attrib['lon'])
    nodes[node_id] = (lat, lon)

# Step 2: Extract roads (ways)
for way in root.findall('way'):
    is_road = False
    nds = []

    for tag in way.findall('tag'):
        if tag.attrib['k'] == 'highway':
            is_road = True
            break

    if not is_road:
        continue

    for nd in way.findall('nd'):
        ref = nd.attrib['ref']
        if ref in nodes:
            nds.append(ref)

    # Connect nodes pairwise
    for i in range(len(nds) - 1):
        a, b = nds[i], nds[i + 1]
        coord_a = nodes[a]
        coord_b = nodes[b]
        distance = haversine(coord_a, coord_b, unit=Unit.METERS)

        if a not in graph:
            graph[a] = []
        if b not in graph:
            graph[b] = []

        graph[a].append((b, distance))
        graph[b].append((a, distance))  # bidirectional
        

# Save graph and nodes to JSON
with open('graph.json', 'w') as f:
    json.dump(graph, f)

with open('nodes.json', 'w') as f:
    json.dump(nodes, f)

print("✅ Graph and nodes saved.")
