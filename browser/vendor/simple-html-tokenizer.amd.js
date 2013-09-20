define(
  ["exports"],
  function(__exports__) {
    "use strict";
    /*jshint boss:true*/

    var objectCreate = Object.create || function(obj) {
      function F() {}
      F.prototype = obj;
      return new F();
    };

    function isSpace(ch) {
      return (/[\n\r\t ]/).test(ch);
    }

    function isAlpha(ch) {
      return (/[A-Za-z]/).test(ch);
    }

    function Tokenizer(input) {
      this.input = input;
      this.ch = 0;
      this.state = 'data';
      this.token = null;
    }

    Tokenizer.prototype = {
      tokenize: function() {
        var tokens = [], token;

        while (true) {
          token = this.lex();
          if (token === 'EOF') { break; }
          if (token) { tokens.push(token); }
        }

        if (this.token) {
          tokens.push(this.token);
        }

        return tokens;
      },

      tokenizePart: function(string) {
        this.input += string;
        var tokens = [], token;

        while (this.ch < this.input.length) {
          token = this.lex();
          if (token) { tokens.push(token); }
        }

        this.tokens = (this.tokens || []).concat(tokens);
        return tokens;
      },

      tokenizeEOF: function() {
        if (this.token) {
          return this.token;
        }
      },

      tag: function(Type, ch) {
        ch = ch.toLowerCase();

        var lastToken = this.token;
        this.token = new Type(ch);
        this.state = 'tagName';
        return lastToken;
      },

      selfClosing: function() {
        this.token.selfClosing = true;
      },

      attribute: function(ch) {
        this.token.startAttribute(ch);
        this.state = 'attributeName';
      },

      addToAttributeName: function(ch) {
        this.token.addToAttributeName(ch.toLowerCase());
      },

      addToAttributeValue: function(ch) {
        this.token.addToAttributeValue(ch);
      },

      commentStart: function() {
        var lastToken = this.token;
        this.token = new CommentToken();
        this.state = 'commentStart';
        return lastToken;
      },

      addToComment: function(ch) {
        this.token.addChar(ch);
      },

      emitData: function() {
        var lastToken = this.token;
        this.token = null;
        this.state = 'tagOpen';
        return lastToken;
      },

      emitToken: function() {
        var lastToken = this.token.finalize();
        this.token = null;
        this.state = 'data';
        return lastToken;
      },

      addData: function(ch) {
        if (this.token === null) {
          this.token = new Chars();
        }

        this.token.addChar(ch);
      },

      lex: function() {
        var ch = this.input.charAt(this.ch++);

        if (ch) {
          // console.log(this.state, ch);
          return this.states[this.state].call(this, ch);
        } else {
          return 'EOF';
        }
      },

      states: {
        data: function(ch) {
          if (ch === "<") {
            return this.emitData();
          } else {
            this.addData(ch);
          }
        },

        tagOpen: function(ch) {
          if (ch === "!") {
            this.state = 'markupDeclaration';
          } else if (ch === "/") {
            this.state = 'endTagOpen';
          } else if (!isSpace(ch)) {
            return this.tag(StartTag, ch);
          }
        },

        markupDeclaration: function(ch) {
          if (ch === "-" && this.input[this.ch] === "-") {
            this.ch++;
            this.commentStart();
          }
        },

        commentStart: function(ch) {
          if (ch === "-") {
            this.state = 'commentStartDash';
          } else if (ch === ">") {
            return this.emitToken();
          } else {
            this.addToComment(ch);
            this.state = 'comment';
          }
        },

        commentStartDash: function(ch) {
          if (ch === "-") {
            this.state = 'commentEnd';
          } else if (ch === ">") {
            return this.emitToken();
          } else {
            this.addToComment("-");
            this.state = 'comment';
          }
        },

        comment: function(ch) {
          if (ch === "-") {
            this.state = 'commentEndDash';
          } else {
            this.addToComment(ch);
          }
        },

        commentEndDash: function(ch) {
          if (ch === "-") {
            this.state = 'commentEnd';
          } else {
            this.addToComment('-' + ch);
            this.state = 'comment';
          }
        },

        commentEnd: function(ch) {
          if (ch === ">") {
            return this.emitToken();
          }
        },

        tagName: function(ch) {
          if (isSpace(ch)) {
            this.state = 'beforeAttributeName';
          } else if(/[A-Za-z]/.test(ch)) {
            this.token.addToTagName(ch);
          } else if (ch === ">") {
            return this.emitToken();
          }
        },

        beforeAttributeName: function(ch) {
          if (isSpace(ch)) {
            return;
          } else if (ch === "/") {
            this.state = 'selfClosingStartTag';
          } else if (ch === ">") {
            return this.emitToken();
          } else {
            this.attribute(ch);
          }
        },

        attributeName: function(ch) {
          if (isSpace(ch)) {
            this.state = 'afterAttributeName';
          } else if (ch === "/") {
            this.state = 'selfClosingStartTag';
          } else if (ch === "=") {
            this.state = 'beforeAttributeValue';
          } else if (ch === ">") {
            return this.emitToken();
          } else {
            this.addToAttributeName(ch);
          }
        },

        beforeAttributeValue: function(ch) {
          if (isSpace(ch)) {
            return;
          } else if (ch === '"') {
            this.state = 'attributeValueDoubleQuoted';
          } else if (ch === "'") {
            this.state = 'attributeValueSingleQuoted';
          } else if (ch === ">") {
            return this.emitToken();
          } else {
            this.state = 'attributeValueUnquoted';
            this.addToAttributeValue(ch);
          }
        },

        attributeValueDoubleQuoted: function(ch) {
          if (ch === '"') {
            this.state = 'afterAttributeValueQuoted';
          } else {
            this.addToAttributeValue(ch);
          }
        },

        attributeValueSingleQuoted: function(ch) {
          if (ch === "'") {
            this.state = 'afterAttributeValueQuoted';
          } else {
            this.addToAttributeValue(ch);
          }
        },

        attributeValueUnquoted: function(ch) {
          if (isSpace(ch)) {
            this.state = 'beforeAttributeName';
          } else if (ch === ">") {
            return this.emitToken();
          } else {
            this.addToAttributeValue(ch);
          }
        },

        afterAttributeValueQuoted: function(ch) {
          if (isSpace(ch)) {
            this.state = 'beforeAttributeName';
          } else if (ch === "/") {
            this.state = 'selfClosingStartTag';
          } else if (ch === ">") {
            return this.emitToken();
          } else {
            this.ch--;
            this.state = 'beforeAttributeName';
          }
        },

        selfClosingStartTag: function(ch) {
          if (ch === ">") {
            this.selfClosing();
            return this.emitToken();
          } else {
            this.ch--;
            this.state = 'beforeAttributeName';
          }
        },

        endTagOpen: function(ch) {
          if (isAlpha(ch)) {
            this.tag(EndTag, ch);
          }
        }
      }
    };

    function Tag(tagName, attributes, options) {
      this.tagName = tagName || "";
      this.attributes = attributes || [];
      this.selfClosing = options ? options.selfClosing : false;
    }

    Tag.prototype = {
      constructor: Tag,

      addToTagName: function(ch) {
        this.tagName += ch;
      },

      startAttribute: function(ch) {
        this.currentAttribute = [ch.toLowerCase(), null];
        this.attributes.push(this.currentAttribute);
      },

      addToAttributeName: function(ch) {
        this.currentAttribute[0] += ch;
      },

      addToAttributeValue: function(ch) {
        this.currentAttribute[1] = this.currentAttribute[1] || "";
        this.currentAttribute[1] += ch;
      },

      finalize: function() {
        delete this.currentAttribute;
        return this;
      }
    };

    function StartTag() {
      Tag.apply(this, arguments);
    }

    StartTag.prototype = objectCreate(Tag.prototype);
    StartTag.prototype.type = 'StartTag';
    StartTag.prototype.constructor = StartTag;

    StartTag.prototype.toHTML = function() {
      return config.generateTag(this);
    };

    function generateTag(tag) {
      var out = "<";
      out += tag.tagName;

      if (tag.attributes.length) {
        out += " " + config.generateAttributes(tag.attributes);
      }

      out += ">";

      return out;
    }

    function generateAttributes(attributes) {
      var out = [], attribute, attrString, value;

      for (var i=0, l=attributes.length; i<l; i++) {
        attribute = attributes[i];

        out.push(config.generateAttribute.apply(this, attribute));
      }

      return out.join(" ");
    }

    function generateAttribute(name, value) {
      var attrString = name;

      if (value) {
        value = value.replace(/"/, '\\"');
        attrString += "=\"" + value + "\"";
      }

      return attrString;
    }

    function EndTag() {
      Tag.apply(this, arguments);
    }

    EndTag.prototype = objectCreate(Tag.prototype);
    EndTag.prototype.type = 'EndTag';
    EndTag.prototype.constructor = EndTag;

    EndTag.prototype.toHTML = function() {
      var out = "</";
      out += this.tagName;
      out += ">";

      return out;
    };

    function Chars(chars) {
      this.chars = chars || "";
    }

    Chars.prototype = {
      type: 'Chars',
      constructor: Chars,

      addChar: function(ch) {
        this.chars += ch;
      },

      toHTML: function() {
        return this.chars;
      }
    };

    function CommentToken() {
      this.chars = "";
    }

    CommentToken.prototype = {
      type: 'CommentToken',
      constructor: CommentToken,

      finalize: function() { return this; },

      addChar: function(ch) {
        this.chars += ch;
      },

      toHTML: function() {
        return "<!--" + this.chars + "-->";
      }
    };

    function tokenize(input) {
      var tokenizer = new Tokenizer(input);
      return tokenizer.tokenize();
    }

    function generate(tokens) {
      var output = "";

      for (var i=0, l=tokens.length; i<l; i++) {
        output += tokens[i].toHTML();
      }

      return output;
    }

    var config = {
      generateAttributes: generateAttributes,
      generateAttribute: generateAttribute,
      generateTag: generateTag
    };

    var original = {
      generateAttributes: generateAttributes,
      generateAttribute: generateAttribute,
      generateTag: generateTag
    };

    function configure(name, value) {
      config[name] = value;
    }


    __exports__.Tokenizer = Tokenizer;
    __exports__.tokenize = tokenize;
    __exports__.generate = generate;
    __exports__.configure = configure;
    __exports__.original = original;
    __exports__.StartTag = StartTag;
    __exports__.EndTag = EndTag;
    __exports__.Chars = Chars;
    __exports__.CommentToken = CommentToken;
  });
