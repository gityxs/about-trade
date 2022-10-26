class ggUtils {
    static distance(p1, p2) {
        return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2))
    }
    static collide(pos, size, nodes) {
        for (var n in nodes) {
            var node = nodes[n];
            if (ggUtils.distance(node.pos, pos) < node.size+size) {
                return true;
            }
        }
        return false;
    }
}

class mathUtils {
    static normalize(value, domain) {
        return value <= domain[0] ? 0
             : value >= domain[1] ? 1
             : (value-domain[0]) / (domain[1] - domain[0]);
    }
}