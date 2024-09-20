"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ISourceFileFactory = void 0;
var ISourceFileFactory;
(function (ISourceFileFactory) {
    function is(obj) {
        return obj.createSourceFile !== undefined;
    }
    ISourceFileFactory.is = is;
})(ISourceFileFactory || (exports.ISourceFileFactory = ISourceFileFactory = {}));
//# sourceMappingURL=programTypes.js.map