"use strict";
/*
 * codeFlowUtils.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Utility functions that operate on code flow nodes and graphs.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatControlFlowGraph = void 0;
const positionUtils_1 = require("../common/positionUtils");
const analyzerNodeInfo_1 = require("./analyzerNodeInfo");
const codeFlowTypes_1 = require("./codeFlowTypes");
function formatControlFlowGraph(flowNode) {
    const links = Object.create(/* o */ null);
    const nodes = [];
    const edges = [];
    const root = buildGraphNode(flowNode, new Set());
    for (const node of nodes) {
        node.text = renderFlowNode(node.flowNode, node.circular);
        computeLevel(node);
    }
    const height = computeHeight(root);
    const columnWidths = computeColumnWidths(height);
    computeLanes(root, 0);
    return renderGraph();
    function getAntecedents(f) {
        if (f.flags & (codeFlowTypes_1.FlowFlags.LoopLabel | codeFlowTypes_1.FlowFlags.BranchLabel)) {
            return f.antecedents;
        }
        if (f.flags &
            (codeFlowTypes_1.FlowFlags.Assignment |
                codeFlowTypes_1.FlowFlags.VariableAnnotation |
                codeFlowTypes_1.FlowFlags.WildcardImport |
                codeFlowTypes_1.FlowFlags.TrueCondition |
                codeFlowTypes_1.FlowFlags.FalseCondition |
                codeFlowTypes_1.FlowFlags.TrueNeverCondition |
                codeFlowTypes_1.FlowFlags.FalseNeverCondition |
                codeFlowTypes_1.FlowFlags.NarrowForPattern |
                codeFlowTypes_1.FlowFlags.ExhaustedMatch |
                codeFlowTypes_1.FlowFlags.Call |
                codeFlowTypes_1.FlowFlags.PreFinallyGate |
                codeFlowTypes_1.FlowFlags.PostFinally)) {
            const typedFlowNode = f;
            return [typedFlowNode.antecedent];
        }
        return [];
    }
    function getChildren(node) {
        const children = [];
        for (const edge of node.edges) {
            if (edge.source === node) {
                children.push(edge.target);
            }
        }
        return children;
    }
    function getParents(node) {
        const parents = [];
        for (const edge of node.edges) {
            if (edge.target === node) {
                parents.push(edge.source);
            }
        }
        return parents;
    }
    function buildGraphNode(flowNode, seen) {
        const id = flowNode.id;
        let graphNode = links[id];
        if (graphNode && seen.has(flowNode)) {
            graphNode = {
                id: -1,
                flowNode,
                edges: [],
                text: '',
                lane: -1,
                endLane: -1,
                level: -1,
                circular: true,
            };
            nodes.push(graphNode);
            return graphNode;
        }
        seen.add(flowNode);
        if (!graphNode) {
            links[id] = graphNode = {
                id,
                flowNode,
                edges: [],
                text: '',
                lane: -1,
                endLane: -1,
                level: -1,
                circular: false,
            };
            nodes.push(graphNode);
            const antecedents = getAntecedents(flowNode);
            for (const antecedent of antecedents) {
                buildGraphEdge(graphNode, antecedent, seen);
            }
        }
        seen.delete(flowNode);
        return graphNode;
    }
    function buildGraphEdge(source, antecedent, seen) {
        const target = buildGraphNode(antecedent, seen);
        const edge = { source, target };
        edges.push(edge);
        source.edges.push(edge);
        target.edges.push(edge);
    }
    function computeLevel(node) {
        if (node.level !== -1) {
            return node.level;
        }
        let level = 0;
        for (const parent of getParents(node)) {
            level = Math.max(level, computeLevel(parent) + 1);
        }
        return (node.level = level);
    }
    function computeHeight(node) {
        let height = 0;
        for (const child of getChildren(node)) {
            height = Math.max(height, computeHeight(child));
        }
        return height + 1;
    }
    function computeColumnWidths(height) {
        const columns = fill(Array(height), 0);
        for (const node of nodes) {
            columns[node.level] = Math.max(columns[node.level], node.text.length);
        }
        return columns;
    }
    function computeLanes(node, lane) {
        if (node.lane === -1) {
            node.lane = lane;
            node.endLane = lane;
            const children = getChildren(node);
            for (let i = 0; i < children.length; i++) {
                if (i > 0)
                    lane++;
                const child = children[i];
                computeLanes(child, lane);
                if (child.endLane > node.endLane) {
                    lane = child.endLane;
                }
            }
            node.endLane = lane;
        }
    }
    function getHeader(flags) {
        if (flags & codeFlowTypes_1.FlowFlags.Start)
            return 'Start';
        if (flags & codeFlowTypes_1.FlowFlags.BranchLabel)
            return 'Branch';
        if (flags & codeFlowTypes_1.FlowFlags.LoopLabel)
            return 'Loop';
        if (flags & codeFlowTypes_1.FlowFlags.Unbind)
            return 'Unbind';
        if (flags & codeFlowTypes_1.FlowFlags.Assignment)
            return 'Assign';
        if (flags & codeFlowTypes_1.FlowFlags.TrueCondition)
            return 'True';
        if (flags & codeFlowTypes_1.FlowFlags.FalseCondition)
            return 'False';
        if (flags & codeFlowTypes_1.FlowFlags.Call)
            return 'Call';
        if (flags & codeFlowTypes_1.FlowFlags.Unreachable)
            return 'Unreachable';
        if (flags & codeFlowTypes_1.FlowFlags.WildcardImport)
            return 'Wildcard';
        if (flags & codeFlowTypes_1.FlowFlags.PreFinallyGate)
            return 'PreFinal';
        if (flags & codeFlowTypes_1.FlowFlags.PostFinally)
            return 'PostFinal';
        if (flags & codeFlowTypes_1.FlowFlags.VariableAnnotation)
            return 'Annotate';
        if (flags & codeFlowTypes_1.FlowFlags.TrueNeverCondition)
            return 'TrueNever';
        if (flags & codeFlowTypes_1.FlowFlags.FalseNeverCondition)
            return 'FalseNever';
        if (flags & codeFlowTypes_1.FlowFlags.NarrowForPattern)
            return 'Pattern';
        if (flags & codeFlowTypes_1.FlowFlags.ExhaustedMatch)
            return 'Exhaust';
        throw new Error();
    }
    function getParseNode(f) {
        if (f.flags & codeFlowTypes_1.FlowFlags.Assignment) {
            return f.node;
        }
        if (f.flags & codeFlowTypes_1.FlowFlags.WildcardImport) {
            return f.node;
        }
        if (f.flags & (codeFlowTypes_1.FlowFlags.TrueCondition | codeFlowTypes_1.FlowFlags.FalseCondition)) {
            return f.expression;
        }
        if (f.flags & codeFlowTypes_1.FlowFlags.NarrowForPattern) {
            return f.statement;
        }
        if (f.flags & codeFlowTypes_1.FlowFlags.Call) {
            return f.node;
        }
        return undefined;
    }
    function getNodeText(f) {
        const parseNode = getParseNode(f);
        if (!parseNode) {
            return undefined;
        }
        const fileInfo = (0, analyzerNodeInfo_1.getFileInfo)(parseNode);
        const startPos = (0, positionUtils_1.convertOffsetToPosition)(parseNode.start, fileInfo.lines);
        return `[${startPos.line + 1}:${startPos.character + 1}]`;
    }
    function renderFlowNode(flowNode, circular) {
        const text = `${getHeader(flowNode.flags)}@${flowNode.id}${getNodeText(flowNode) || ''}`;
        return circular ? `Circular(${text})` : text;
    }
    function renderGraph() {
        const columnCount = columnWidths.length;
        const laneCount = nodes.reduce((x, n) => Math.max(x, n.lane), 0) + 1;
        const lanes = fill(Array(laneCount), '');
        const grid = columnWidths.map(() => Array(laneCount));
        const connectors = columnWidths.map(() => fill(Array(laneCount), 0));
        // Build connectors.
        for (const node of nodes) {
            grid[node.level][node.lane] = node;
            const children = getChildren(node);
            for (let i = 0; i < children.length; i++) {
                const child = children[i];
                let connector = 8 /* Connection.Right */;
                if (child.lane === node.lane)
                    connector |= 4 /* Connection.Left */;
                if (i > 0)
                    connector |= 1 /* Connection.Up */;
                if (i < children.length - 1)
                    connector |= 2 /* Connection.Down */;
                connectors[node.level][child.lane] |= connector;
            }
            if (children.length === 0) {
                connectors[node.level][node.lane] |= 16 /* Connection.NoChildren */;
            }
            const parents = getParents(node);
            for (let i = 0; i < parents.length; i++) {
                const parent = parents[i];
                let connector = 4 /* Connection.Left */;
                if (i > 0)
                    connector |= 1 /* Connection.Up */;
                if (i < parents.length - 1)
                    connector |= 2 /* Connection.Down */;
                connectors[node.level - 1][parent.lane] |= connector;
            }
        }
        // Fill in missing connectors.
        for (let column = 0; column < columnCount; column++) {
            for (let lane = 0; lane < laneCount; lane++) {
                const left = column > 0 ? connectors[column - 1][lane] : 0;
                const above = lane > 0 ? connectors[column][lane - 1] : 0;
                let connector = connectors[column][lane];
                if (!connector) {
                    connector = 0 /* Connection.None */;
                    if (left & 8 /* Connection.Right */) {
                        connector |= 12 /* Connection.LeftRight */;
                    }
                    if (above & 2 /* Connection.Down */) {
                        connector |= 3 /* Connection.UpDown */;
                    }
                    connectors[column][lane] = connector;
                }
            }
        }
        for (let column = 0; column < columnCount; column++) {
            for (let lane = 0; lane < lanes.length; lane++) {
                const connector = connectors[column][lane];
                const fill = connector & 4 /* Connection.Left */ ? "\u2500" /* BoxCharacter.lr */ : ' ';
                const node = grid[column][lane];
                if (!node) {
                    if (column < columnCount - 1) {
                        writeLane(lane, repeat(fill, columnWidths[column] + 1));
                    }
                }
                else {
                    writeLane(lane, node.text);
                    if (column < columnCount - 1) {
                        writeLane(lane, ' ');
                        writeLane(lane, repeat(fill, columnWidths[column] - node.text.length));
                    }
                }
                writeLane(lane, getBoxCharacter(connector));
                writeLane(lane, connector & 8 /* Connection.Right */ && column < columnCount - 1 && !grid[column + 1][lane]
                    ? "\u2500" /* BoxCharacter.lr */
                    : ' ');
            }
        }
        return `${lanes.join('\n')}\n`;
        function writeLane(lane, text) {
            lanes[lane] += text;
        }
    }
    function getBoxCharacter(connector) {
        switch (connector) {
            case 3 /* Connection.UpDown */:
                return "\u2502" /* BoxCharacter.ud */;
            case 12 /* Connection.LeftRight */:
                return "\u2500" /* BoxCharacter.lr */;
            case 5 /* Connection.UpLeft */:
                return "\u256F" /* BoxCharacter.ul */;
            case 9 /* Connection.UpRight */:
                return "\u2570" /* BoxCharacter.ur */;
            case 6 /* Connection.DownLeft */:
                return "\u256E" /* BoxCharacter.dl */;
            case 10 /* Connection.DownRight */:
                return "\u256D" /* BoxCharacter.dr */;
            case 7 /* Connection.UpDownLeft */:
                return "\u2524" /* BoxCharacter.udl */;
            case 11 /* Connection.UpDownRight */:
                return "\u251C" /* BoxCharacter.udr */;
            case 13 /* Connection.UpLeftRight */:
                return "\u2534" /* BoxCharacter.ulr */;
            case 14 /* Connection.DownLeftRight */:
                return "\u252C" /* BoxCharacter.dlr */;
            case 15 /* Connection.UpDownLeftRight */:
                return "\u256B" /* BoxCharacter.udlr */;
        }
        return ' ';
    }
    function fill(array, value) {
        if (array.fill) {
            array.fill(value);
        }
        else {
            for (let i = 0; i < array.length; i++) {
                array[i] = value;
            }
        }
        return array;
    }
    function repeat(ch, length) {
        if (ch.repeat) {
            return length > 0 ? ch.repeat(length) : '';
        }
        let s = '';
        while (s.length < length) {
            s += ch;
        }
        return s;
    }
}
exports.formatControlFlowGraph = formatControlFlowGraph;
//# sourceMappingURL=codeFlowUtils.js.map